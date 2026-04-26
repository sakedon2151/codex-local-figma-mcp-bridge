# Figma 수동 검증 가이드

## 1. 목적

이 문서는 Figma Desktop을 사용해 MVP의 end-to-end 동작을 검증하기 위한 체크리스트입니다. 자동 테스트, 타입체크, 린트, 빌드가 모두 통과한 뒤 실행합니다.

## 2. 사전 준비

- Node.js 20 이상
- Figma Desktop 설치
- 편집 권한이 있는 Figma draft 파일
- `npm install`로 프로젝트 의존성 설치 완료

## 3. 플러그인 빌드

다음 명령어를 실행합니다.

```bash
npm run build
```

아래 파일들이 생성되어야 합니다.

- `dist/plugin/manifest.json`
- `dist/plugin/code.js`
- `dist/plugin/ui.html`
- `dist/plugin/ui.js`

주의:

- Figma plugin main thread는 일부 최신 JavaScript 문법을 파싱하지 못할 수 있습니다.
- 플러그인은 `esbuild.config.mjs`에서 `target: "es2017"`로 번들링합니다.
- Figma UI는 `figma.showUI(__html__)`로 HTML 문자열을 로드하므로, `dist/plugin/ui.html` 안에 UI script가 inline으로 포함되어야 합니다.
- `dist/plugin/code.js`에서 `Unexpected token ...` syntax error가 발생하면 `npm run build`를 다시 실행해 최신 번들을 생성합니다.

## 4. Codex 앱에 MCP 서버 연결

Codex 앱에서 이 MCP를 사용하려면 Codex가 직접 MCP 서버 프로세스를 실행해야 합니다. 터미널에서 직접 실행한 `npm run dev:mcp` 프로세스는 Figma 플러그인과 연결될 수 있지만, Codex 앱의 MCP client와는 연결되지 않습니다.

### 4.1 권장: 로컬 Codex 플러그인 래퍼 사용

이 프로젝트에는 Codex App이 MCP 서버를 플러그인 경로로 발견할 수 있도록 아래 파일들이 포함되어 있습니다.

- `.agents/plugins/marketplace.json`
- `plugins/local-figma/.codex-plugin/plugin.json`
- `plugins/local-figma/.mcp.json`

`plugins/local-figma/.mcp.json`은 아래 명령을 실행합니다.

```bash
node --import tsx /Users/nimnas/Documents/Personal/codex-talk-to-figma-project/src/mcp/server.ts
```

Codex는 local marketplace 플러그인을 `~/.codex/plugins/cache/.../<plugin>/<version>` 아래로 복사한 뒤 실행할 수 있습니다. 따라서 `.mcp.json`에서 `../..` 같은 상대 경로로 프로젝트 루트를 찾으면 캐시 내부를 가리켜 실패합니다. local development 환경에서는 현재 프로젝트의 절대 경로를 사용합니다.

또한 MCP stdio 서버의 stdout은 JSON-RPC 프로토콜 전용이어야 합니다. `npm run dev:mcp`는 시작 시 npm lifecycle 배너를 stdout에 출력할 수 있으므로 Codex MCP handshake를 깨뜨릴 수 있습니다. 플러그인 래퍼는 이 문제를 피하기 위해 `npm run` 대신 `node --import tsx`로 서버를 직접 실행합니다.

사용 절차:

1. 프로젝트 루트에서 local marketplace를 등록합니다.

```bash
codex plugin marketplace add "$PWD"
```

2. 기존 custom MCP 등록이 남아 있으면 제거합니다. 두 경로가 동시에 켜지면 둘 다 `3846` 포트를 사용하므로 충돌할 수 있습니다.

```bash
codex mcp remove local-figma
```

3. Codex 앱의 플러그인/마켓플레이스 화면에서 `Local Figma MCP` 또는 `local-figma`가 표시되는지 확인합니다.
4. 표시되면 설치 또는 활성화합니다.
5. Codex 앱을 완전히 종료한 뒤 다시 실행합니다.
6. 새 thread를 시작합니다.
7. 아래 요청을 보냅니다.

```text
local-figma MCP의 figma_status를 호출해서 pairing 정보를 보여줘.
```

기대 결과:

- `figma_status` tool이 바로 호출됩니다.
- `data.pairing.sessionId`, `data.pairing.pairingToken`, `data.plugin.paired`가 반환됩니다.
- 이때부터 해당 thread에서 `figma_get_selection`, `figma_create_node` 등 local-figma MCP tools를 사용할 수 있습니다.

주의:

- `AGENTS.md`는 tool 사용 지침만 제공합니다. MCP 서버를 로드하거나 tool을 노출시키지는 않습니다.
- thread에서 `figma_status`가 보이지 않으면, 해당 thread에는 `local-figma` MCP 서버가 로드되지 않은 것입니다.
- 공식 Figma MCP namespace만 보이는 경우에도 이 프로젝트의 로컬 브리지는 연결된 것이 아닙니다.
- 기존 thread에는 새 marketplace/plugin 설정이 반영되지 않을 수 있습니다. 반드시 Codex 앱 재시작 후 새 thread에서 확인합니다.

플러그인 UI에서 활성화했는데도 설정 파일에 enabled 항목이 생기지 않으면, `~/.codex/config.toml`에 아래 항목이 있는지 확인합니다.

```toml
[plugins."local-figma@codex-talk-to-figma-project"]
enabled = true
```

캐시된 플러그인이 예전 `.mcp.json`을 계속 사용하는 경우에는 아래 경로를 확인합니다.

```bash
find ~/.codex/plugins/cache/codex-talk-to-figma-project/local-figma -maxdepth 3 -name .mcp.json
```

캐시 안의 `.mcp.json`에 `--prefix ../..`가 남아 있으면 오래된 캐시입니다. 플러그인 버전을 올린 뒤 marketplace를 다시 등록하거나, 캐시를 삭제하고 다시 등록합니다.

### 4.2 대안: Codex 앱 설정 화면으로 custom MCP 등록

Codex 앱의 `설정 > MCP 서버 > 맞춤형 MCP에 연결` 화면에서 아래 값을 입력합니다.

| 항목               | 값                                                                               |
| ------------------ | -------------------------------------------------------------------------------- |
| 이름               | `local-figma`                                                                    |
| Transport          | `STDIO`                                                                          |
| 실행 명령          | `/Users/nimnas/.nvm/versions/node/v24.15.0/bin/node`                             |
| 인자 1             | `--import`                                                                       |
| 인자 2             | `tsx`                                                                            |
| 인자 3             | `/Users/nimnas/Documents/Personal/codex-talk-to-figma-project/src/mcp/server.ts` |
| 환경 변수          | 비워 둠                                                                          |
| 환경 변수 패스스루 | 비워 둠                                                                          |
| 작업 중인 디렉터리 | `/Users/nimnas/Documents/Personal/codex-talk-to-figma-project`                   |

`node` 경로가 다르면 터미널에서 아래 명령어로 확인한 값을 `실행 명령`에 입력합니다.

```bash
command -v node
```

저장 후 Codex 앱에서 새 thread를 시작하거나 앱을 재시작합니다.

### 4.3 CLI로 custom MCP 등록

Codex 앱 설정 화면 대신 CLI로도 같은 설정을 등록할 수 있습니다. CLI의 `codex mcp add`는 별도 작업 디렉터리 값을 받지 않으므로, 프로젝트 루트에서 아래처럼 `npm --silent --prefix "$PWD"`를 사용합니다. `--silent`는 MCP stdio handshake를 깨뜨릴 수 있는 npm lifecycle 배너를 숨깁니다.

```bash
codex mcp add local-figma -- npm --silent --prefix "$PWD" run dev:mcp
```

등록 확인:

```bash
codex mcp list
```

기대 결과:

```text
local-figma ... enabled
```

주의:

- 등록 후 Codex 앱에서 새 thread를 시작하거나 앱을 재시작합니다.
- 수동으로 실행 중인 `npm run dev:mcp`가 있으면 중지합니다. Codex가 MCP 서버를 실행할 때 같은 `3846` 포트를 사용하기 때문입니다.
- macOS에서 Codex 앱이 `npm`을 찾지 못하면 `command -v npm`으로 확인한 절대 경로를 사용합니다.

예시:

```bash
codex mcp remove local-figma
codex mcp add local-figma -- /absolute/path/to/npm --silent --prefix "$PWD" run dev:mcp
```

## 5. Figma 플러그인 로드

Figma Desktop에서 다음 순서로 진행합니다.

1. draft 파일을 엽니다.
2. `Plugins > Development > Import plugin from manifest` 메뉴로 이동합니다.
3. `dist/plugin/manifest.json` 파일을 선택합니다.
4. `Local Codex Figma Bridge` 플러그인을 실행합니다.

주의:

- 반드시 `Import plugin from manifest`를 선택합니다.
- `Import widget from manifest`를 선택하면 Figma가 widget manifest를 기대하므로 `manifest.containsWidget` 관련 오류가 발생합니다.
- 이 프로젝트는 Figma Plugin API 기반이며, widget manifest가 아닙니다. 따라서 `containsWidget: true`와 `widgetApi`를 추가하지 않습니다.

## 6. 플러그인 페어링

Codex 앱의 새 thread에서 아래처럼 요청합니다.

```text
local-figma MCP의 figma_status를 호출해서 pairing 정보를 보여줘.
```

`figma_status` 응답의 `data.pairing`에 아래 값이 포함됩니다.

```json
{
  "sessionId": "ses_...",
  "pairingToken": "000000",
  "expiresAt": "..."
}
```

플러그인 UI에서 다음 값을 입력합니다.

1. Server URL은 `ws://localhost:3846/figma` 그대로 둡니다.
2. `figma_status` 응답에 표시된 session ID를 입력합니다.
3. `figma_status` 응답에 표시된 pairing token을 입력합니다.
4. Connect 버튼을 클릭합니다.

기대 결과:

- 플러그인 UI에 `Paired with local bridge.`가 표시됩니다.
- 서버 프로세스가 오류 없이 계속 실행됩니다.

## 7. MVP MCP 플로우 검증

Codex 앱 thread에서 아래처럼 자연어로 요청합니다. Codex가 등록된 `local-figma` MCP tool을 호출해야 합니다.

1. `figma_status`를 호출해서 `plugin.paired: true`인지 확인해줘.
2. `figma_get_selection`으로 현재 선택 영역을 읽어줘.
3. Figma에 320x180 `FRAME`을 하나 생성해줘.
4. 방금 만든 frame 안에 `TEXT` child를 하나 생성해줘.
5. 생성한 text node의 이름이나 위치를 업데이트해줘.
6. 생성한 text node를 `figma_read_node`로 읽어줘.
7. 생성한 text node를 `figma_delete_node`로 삭제해줘.

도구를 직접 호출할 수 있는 MCP client에서는 아래 순서로 호출합니다.

1. `figma_status`
2. `figma_get_selection`
3. `figma_create_node`
4. `figma_create_node`
5. `figma_update_node`
6. `figma_read_node`
7. `figma_delete_node`

기대 결과:

- `figma_status`가 `plugin.paired: true`를 반환합니다.
- selection 조회 결과가 JSON으로 반환됩니다.
- 생성된 node가 열려 있는 Figma draft에 표시됩니다.
- update 결과가 Figma 화면에 반영됩니다.
- read node 결과가 제한된 크기의 JSON으로 반환됩니다.
- delete는 대상 node만 제거합니다.

## 8. Undo 검증

Figma Desktop에서 다음을 확인합니다.

1. delete 이후 undo를 실행합니다.
2. 삭제된 node가 복구되는지 확인합니다.
3. 추가로 undo를 실행해 이전 mutation들이 Figma undo stack으로 복구 가능한지 확인합니다.

## 9. 실패 시나리오 검증

아래 상황이 안전하게 실패하는지 확인합니다.

- 잘못된 token으로 pairing을 시도합니다.
- pairing 전에 `figma_get_selection`을 호출합니다.
- 존재하지 않는 node ID로 `figma_read_node`를 호출합니다.
- 지원하지 않는 `VECTOR` type으로 `figma_create_node`를 호출합니다.

기대 결과:

- 잘못된 token은 거부됩니다.
- pairing되지 않은 상태의 tool call은 `PLUGIN_DISCONNECTED`를 반환합니다.
- 존재하지 않는 node는 `NODE_NOT_FOUND`를 반환합니다.
- 지원하지 않는 node type은 Figma에 도달하기 전에 validation error로 거부됩니다.

## 10. Manifest Import 오류 대응

### `allowedDomains` URL 오류

`allowedDomains`에서 `127.0.0.1` URL을 거부하는 오류가 발생하면 `npm run build`를 다시 실행한 뒤 `dist/plugin/manifest.json`에 아래 값만 있는지 확인합니다.

```json
"allowedDomains": ["ws://localhost:3846", "http://localhost:3846"]
```

### `manifest.containsWidget` 오류

아래 오류가 표시되면 plugin manifest를 widget importer로 가져온 것입니다.

```text
Expected "manifest.containsWidget" to have type true but got undefined instead
```

해결 방법:

1. Figma Design draft 파일을 엽니다.
2. `Plugins > Development > Import plugin from manifest`를 선택합니다.
3. `Widgets > Development > Import widget from manifest` 또는 widget 관련 import 메뉴는 사용하지 않습니다.
4. 다시 `dist/plugin/manifest.json`을 선택합니다.

### `Unexpected token ...` syntax error

Figma 개발자 콘솔에서 아래와 같은 오류가 표시되면 plugin bundle에 Figma main thread가 파싱하지 못하는 최신 JavaScript 문법이 남아 있는 것입니다.

```text
Syntax error on line ...: Unexpected token ...
```

해결 방법:

1. `npm run build`를 다시 실행합니다.
2. Figma Desktop에서 개발 플러그인을 다시 실행합니다.
3. 계속 발생하면 `esbuild.config.mjs`의 plugin build target이 `es2017`인지 확인합니다.

### Connect 버튼을 눌러도 상태가 바뀌지 않는 경우

HTML은 보이지만 버튼 클릭 후 `Connecting...` 같은 상태 변화가 없다면 UI script가 실행되지 않은 것입니다.

확인 방법:

1. `npm run build`를 다시 실행합니다.
2. `dist/plugin/ui.html`에 `<script src="./ui.js"></script>`가 남아 있지 않은지 확인합니다.
3. Figma Desktop에서 개발 플러그인을 다시 실행합니다.
4. 그래도 동일하면 기존 개발 플러그인을 제거한 뒤 `dist/plugin/manifest.json`을 다시 import합니다.

### Codex thread에서 `figma_status` 도구를 못 찾는 경우

다른 thread에서 Codex가 `figma_status`를 바로 호출하지 못하고 파일 검색이나 임시 스크립트 생성으로 우회하면, 해당 thread에 `local-figma` MCP tool이 노출되지 않은 상태입니다.

확인 방법:

1. 우선 `Local Figma MCP` Codex 플러그인 래퍼가 설치 또는 활성화되어 있는지 확인합니다.
2. 플러그인 래퍼를 사용할 수 없다면 Codex 앱 설정의 `MCP 서버`에서 `local-figma`가 enabled인지 확인합니다.
3. custom MCP 등록을 사용하는 경우 `npm run dev:mcp`처럼 npm lifecycle 배너가 stdout에 출력되는 명령을 쓰고 있지 않은지 확인합니다.
4. 앱 설정 방식이면 `node`, `--import`, `tsx`, 프로젝트의 `src/mcp/server.ts` 절대 경로와 프로젝트 작업 디렉터리가 들어 있는지 확인합니다.
5. CLI 등록 방식이면 `npm`, `--silent`, `--prefix`, 프로젝트 절대 경로, `run`, `dev:mcp`가 순서대로 들어 있는지 확인합니다.
6. 수동으로 실행 중인 `npm run dev:mcp`가 있으면 중지합니다.
7. Codex 앱을 완전히 종료한 뒤 다시 실행하고 새 thread를 시작합니다.
8. 그래도 보이지 않으면 custom MCP 설정은 저장되어 있지만 현재 Codex App thread에 주입되지 않은 상태입니다. 이 경우 로컬 플러그인 래퍼 경로를 우선 사용합니다.

정상 등록 여부는 터미널에서 아래 명령어로 확인할 수 있습니다.

```bash
codex mcp list
```

그리고 MCP 서버 자체가 tool list를 반환하는지는 아래 명령으로 확인할 수 있습니다.

```bash
node --input-type=module -e 'import { Client } from "@modelcontextprotocol/sdk/client/index.js"; import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"; const cwd = process.cwd(); const transport = new StdioClientTransport({ command: "node", args: ["--import", "tsx", `${cwd}/src/mcp/server.ts`], cwd }); const client = new Client({ name: "local-figma-smoke", version: "0.0.0" }); await client.connect(transport); const tools = await client.listTools(); console.log(tools.tools.map((tool) => tool.name)); await client.close();'
```
