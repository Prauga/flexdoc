# Phoenix + FlexDoc

Add `{:prauga_flexdoc, "0.3.0"}` and forward your docs route to the packaged Plug:

```elixir
scope "/" do
  forward "/docs", PraugaFlexDoc.Plug,
    path: "/docs",
    spec_url: "/openapi.json",
    title: "Phoenix API"
end
```

Phoenix already uses Plug, so `PraugaFlexDoc.Plug` is the first-class Phoenix integration. The same module also works directly in Plug applications.
