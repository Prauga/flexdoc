import fs from 'fs';
import path from 'path';
import { validateRuntimeContract } from './contract-validation';

const fixturePath = path.resolve(__dirname, '../../../contracts/contract-validation-fixtures.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
  cases: Array<{ name: string; input: Parameters<typeof validateRuntimeContract>[0]; expected: ReturnType<typeof validateRuntimeContract> }>;
};

describe('shared contract validation fixture', () => {
  it.each(fixture.cases)('$name matches the language-neutral fixture', ({ input, expected }) => {
    expect(validateRuntimeContract({
      ...input,
      acknowledgedUndocumented: input.acknowledgedUndocumented || [],
    })).toEqual(expected);
  });
});
