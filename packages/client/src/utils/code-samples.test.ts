import { generateCodeSample } from './code-samples';

const request = {
  url: 'https://api.example.com/users?limit=10',
  method: 'POST',
  headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
  body: '{"name":"Ada"}',
  init: {},
};

describe('code sample generation', () => {
  it.each(['curl', 'javascript', 'python', 'go', 'java'] as const)('generates %s using the same request', (language) => {
    const code = generateCodeSample(request, language);
    expect(code).toContain('https://api.example.com/users?limit=10');
    expect(code.toLowerCase()).toContain('post');
  });

  it('includes request headers and body in curl', () => {
    const code = generateCodeSample(request, 'curl');
    expect(code).toContain('Authorization: Bearer token');
    expect(code).toContain('{\\"name\\":\\"Ada\\"}');
  });
});
