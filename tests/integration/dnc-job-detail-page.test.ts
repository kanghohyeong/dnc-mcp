import { describe, it, expect } from "vitest";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

describe("DnC Job Detail Page - Markdown Rendering", () => {
  // TC7: 마크다운 라이브러리가 올바르게 HTML을 생성함
  it("should correctly convert markdown to HTML", async () => {
    const markdown = `# Test Header

This is a paragraph.

## Subheader

- List item 1
- List item 2

\`\`\`typescript
const test = "code";
\`\`\`

**Bold text** and *italic text*.`;

    const html = await marked.parse(markdown);

    // 제목 변환 확인
    expect(html).toContain("<h1>Test Header</h1>");
    expect(html).toContain("<h2>Subheader</h2>");

    // 목록 변환 확인
    expect(html).toContain("<li>List item 1</li>");
    expect(html).toContain("<li>List item 2</li>");

    // 코드 블록 변환 확인
    expect(html).toContain("<code");
    // HTML 엔티티로 escape된 코드 또는 원본 코드
    expect(html).toMatch(/const test = (&quot;|")code(&quot;|")/);

    // 강조 텍스트 변환 확인
    expect(html).toContain("<strong>Bold text</strong>");
    expect(html).toContain("<em>italic text</em>");
  });

  // TC8: 특수 문자가 이스케이프 처리됨 (XSS 방지)
  it("should escape special characters to prevent XSS", async () => {
    const maliciousMarkdown = `# Title

<script>alert('XSS')</script>

<img src=x onerror="alert('XSS')">

[Link](javascript:alert('XSS'))`;

    const rawHtml = await marked.parse(maliciousMarkdown);
    const html = sanitizeHtml(rawHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        code: ["class"],
      },
    });

    // script 태그가 제거되어야 함
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("alert('XSS')");

    // onerror 핸들러가 제거되어야 함
    expect(html).not.toContain("onerror");

    // javascript: 프로토콜이 제거되어야 함
    expect(html).not.toContain("javascript:");
  });

  it("should handle empty markdown content", async () => {
    const emptyMarkdown = "";
    const html = await marked.parse(emptyMarkdown);

    expect(html).toBe("");
  });

  it("should handle markdown with only whitespace", async () => {
    const whitespaceMarkdown = "   \n\n   \n   ";
    const html = await marked.parse(whitespaceMarkdown);

    expect(html.trim()).toBe("");
  });

  it("should handle complex nested markdown structures", async () => {
    const complexMarkdown = `# Main Title

## Section 1

This is a paragraph with **bold** and *italic* text.

### Subsection 1.1

- Item 1
  - Nested item 1.1
  - Nested item 1.2
- Item 2

\`\`\`javascript
function test() {
  console.log("nested code");
}
\`\`\`

## Section 2

> This is a blockquote
> with multiple lines

1. Numbered item 1
2. Numbered item 2
3. Numbered item 3`;

    const html = await marked.parse(complexMarkdown);

    // 모든 요소가 포함되어야 함
    expect(html).toContain("<h1>Main Title</h1>");
    expect(html).toContain("<h2>Section 1</h2>");
    expect(html).toContain("<h3>Subsection 1.1</h3>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<code");
  });
});
