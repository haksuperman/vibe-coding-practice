// Claude Code PreToolUse 훅: Bash로 'git commit'을 실행하려 할 때
// 대상 프로젝트에서 lint -> build -> test를 돌리고, 하나라도 실패하면 커밋을 차단한다.
//
// 훅은 stdin으로 { tool_input: { command } } JSON을 받는다.
// 통과: exit 0 / 차단: exit 2 (+ stderr 메시지가 Claude에게 전달됨)
//
// 검사는 CLAUDE_PROJECT_DIR(작업 중인 프로젝트)에서 실행되므로,
// 그 프로젝트에 npm run lint/build/test 스크립트가 있어야 한다.
import { execSync } from "node:child_process";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input || "{}");
  } catch {
    /* 파싱 실패 시 게이트하지 않고 통과 */
  }

  const command = (data.tool_input && data.tool_input.command) || "";

  // 실제 git commit 명령일 때만 검사 (git log/status 등은 통과)
  if (!/\bgit\s+commit\b/.test(command)) {
    process.exit(0);
  }

  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const steps = [
    ["lint", "npm run lint --silent"],
    ["build", "npm run build --silent"],
    ["test", "npm test --silent"],
  ];

  for (const [name, cmd] of steps) {
    try {
      execSync(cmd, { cwd, stdio: "pipe" });
    } catch (e) {
      const out =
        (e.stdout ? e.stdout.toString() : "") +
        (e.stderr ? e.stderr.toString() : "");
      console.error(
        "❌ 프리 커밋 검사 실패 [" +
          name +
          "] — 커밋을 중단합니다.\n" +
          out.trim()
      );
      process.exit(2); // 도구 호출(커밋) 차단
    }
  }

  console.error("✅ 프리 커밋 검사 통과 (lint · build · test)");
  process.exit(0);
});
