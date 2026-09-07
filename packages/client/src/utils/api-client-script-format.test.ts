import { apiClientScriptDiagnostic, formatApiClientScript, formatApiClientScriptSelection } from './api-client-script-format';

describe('api-client-script-format', () => {
  it('formats existing JavaScript lines without changing their order', () => {
    expect(formatApiClientScript("flex.test('status', () => {\nflex.expect(flex.response.code).to.equal(200);\n});")).toBe(
      "flex.test('status', () => {\n  flex.expect(flex.response.code).to.equal(200);\n});",
    );
  });

  it('ignores braces inside strings and comments while indenting', () => {
    expect(formatApiClientScript("if (true) {\nconsole.log('{'); // }\nconsole.log(\"}\");\n}")).toBe(
      "if (true) {\n  console.log('{'); // }\n  console.log(\"}\");\n}",
    );
  });

  it('preserves the logical caret position when formatting indentation', () => {
    const source = "if (true) {\nconsole.log('ok');\n}";
    const caret = source.indexOf("'ok'") + 3;
    const formatted = formatApiClientScriptSelection(source, caret);
    expect(formatted.value).toBe("if (true) {\n  console.log('ok');\n}");
    expect(formatted.value.slice(0, formatted.selectionStart).endsWith("'ok")).toBe(true);
    expect(formatted.selectionEnd).toBe(formatted.selectionStart);
  });

  it('preserves a selection across formatted lines', () => {
    const source = "if (true) {\nconsole.log('a');\nconsole.log('b');\n}";
    const selectionStart = source.indexOf("console.log('a')");
    const selectionEnd = source.indexOf("console.log('b')") + "console.log('b')".length;
    const formatted = formatApiClientScriptSelection(source, selectionStart, selectionEnd);
    expect(formatted.value.slice(formatted.selectionStart, formatted.selectionEnd)).toContain("console.log('a');\n  console.log('b')");
  });

  it('reports syntax errors without executing the script', () => {
    expect(apiClientScriptDiagnostic('const broken = ;').valid).toBe(false);
    expect(apiClientScriptDiagnostic("await Promise.resolve();\nflex.request.method = 'POST';")).toEqual({ valid: true, message: 'Syntax OK' });
  });
});
