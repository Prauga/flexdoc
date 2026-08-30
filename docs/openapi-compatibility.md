# OpenAPI compatibility

FlexDoc targets OpenAPI 3.0.x and 3.1.x. This matrix describes behavior covered by the repository compatibility corpus rather than claiming blanket support for every edge of the specifications.

Legend: **✅ tested** · **◐ partial / constrained** · **— not currently implemented as a first-class behavior**

| Area | OpenAPI 3.0 | OpenAPI 3.1 | Notes |
| --- | :---: | :---: | --- |
| JSON specifications | ✅ | ✅ | Parsed directly. |
| YAML specifications | ✅ | ✅ | Parsed through `js-yaml`. |
| Local JSON Pointer `$ref` | ✅ | ✅ | Includes escaped pointer tokens. |
| External `$ref` bundling | ✅ | ✅ | Browser fetch requires ordinary CORS access; custom loaders can be supplied programmatically. |
| Nested external `$ref` | ✅ | ✅ | Bundled into local JSON pointers. |
| Circular external `$ref` | ✅ | ✅ | References stay as references rather than expanding infinitely. |
| External document `$ref` back to root | ✅ | ✅ | Rewritten back to the root pointer. |
| Recursive component schemas | ✅ | ✅ | Cycle-safe renderer behavior. |
| Path-item + operation parameter merge | ✅ | ✅ | Operation parameter wins for the same `in` + `name`. |
| Referenced parameters/request bodies/responses | ✅ | ✅ | Resolved before request/render use. |
| Root/path/operation servers | ✅ | ✅ | Most specific server list wins. |
| Server variables/defaults/enums | ✅ | ✅ | Invalid enum values are rejected. |
| Query `form` serialization | ✅ | ✅ | Arrays and objects; explode true/false. |
| Query `spaceDelimited` / `pipeDelimited` | ✅ | ✅ | Arrays. |
| Query `deepObject` | ✅ | ✅ | Flat object properties. Nested deep-object structures are not recursively expanded. |
| Path `simple` serialization | ✅ | ✅ | Primitive/array/object. |
| Path `label` serialization | ✅ | ✅ | Primitive/array/object with explode semantics. |
| Path `matrix` serialization | ✅ | ✅ | Primitive/array/object with explode semantics. |
| Header parameters | ✅ | ✅ | Simple serialization. |
| Cookie parameters | ✅ | ✅ | Simple serialization and Cookie header composition. |
| `allowReserved` | ✅ | ✅ | Applied to serialized parameter values. |
| Bearer auth | ✅ | ✅ | HTTP bearer. |
| Basic auth | ✅ | ✅ | Credential value is supplied as `username:password`; additional colons are preserved. |
| API keys: header/query/cookie | ✅ | ✅ | All three OpenAPI locations. |
| OAuth2 / OpenID Connect token injection | ✅ | ✅ | Supplied access token is emitted as Bearer; FlexDoc does not implement an OAuth authorization flow yet. |
| Security AND/OR requirements | ✅ | ✅ | Selects a satisfiable alternative and applies all schemes in that requirement. |
| JSON request bodies | ✅ | ✅ | Includes media/schema examples used for initial values. |
| `application/x-www-form-urlencoded` | ✅ | ✅ | JSON editor object is serialized to form data. |
| `multipart/form-data` | ✅ | ✅ | Uses `FormData`; browser supplies the multipart boundary. Binary file picking is not yet first-class. |
| `allOf` / `oneOf` / `anyOf` | ✅ | ✅ | Rendered recursively. |
| `nullable` | ✅ | — | OpenAPI 3.0 keyword is rendered. |
| JSON Schema `type: [T, "null"]` | — | ✅ | Rendered as nullable in 3.1-style schemas. |
| `const`, enum, defaults, examples | ✅ | ✅ | Retained/rendered where applicable. |
| `additionalProperties` schema | ✅ | ✅ | Schema-valued additional properties are rendered. Boolean values are retained; boolean-specific UI is minimal. |
| `patternProperties` / JSON Schema conditionals | — | ◐ | Types retain these 3.1 keywords, but there is not yet dedicated renderer UI for them. |
| Discriminator | ✅ | ✅ | Retained in the schema model; dedicated discriminator visualization is not yet implemented. |
| Webhooks | — | ◐ | Represented in the 3.1 type model, but not exposed as a first-class navigation surface yet. |
| Callbacks | ◐ | ◐ | Represented in the model; not a first-class interactive surface yet. |
| XML-specific rendering | ◐ | ◐ | XML metadata is retained, but request generation is primarily JSON/form oriented. |

## Compatibility corpus

The regression corpus lives under:

- `packages/client/src/fixtures/openapi/compatibility.ts`
- `packages/client/src/utils/openapi-compatibility.test.ts`

Fixtures are intentionally small and semantic. New OpenAPI fixes should add or extend a fixture and assert the exact behavior that previously failed.

The corpus currently covers:

- OpenAPI 3.0.3 and 3.1.0 parsing
- malformed-input errors
- parameter precedence
- referenced request/response objects
- server variables
- path/query/header/cookie serialization
- multiple security scheme locations and alternatives
- JSON, form-urlencoded and multipart bodies
- 3.0 nullable schemas and 3.1 nullable type arrays
- schema composition and recursive schemas
- nested and circular external documents
- external references that point back into the root specification

This matrix should only move a feature to **✅ tested** when there is an automated regression test for the behavior.
