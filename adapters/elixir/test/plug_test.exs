defmodule PraugaFlexDoc.PlugTest do
  use ExUnit.Case, async: true
  use Plug.Test

  alias PraugaFlexDoc.Plug, as: FlexDocPlug

  @opts FlexDocPlug.init(path: "/reference", spec_url: "/openapi.json", title: "Plug <API>")

  test "serves docs and packaged renderer assets" do
    docs = conn(:get, "/reference") |> FlexDocPlug.call(@opts)
    assert docs.status == 200
    assert get_resp_header(docs, "cache-control") == ["no-cache"]
    assert docs.resp_body =~ "Plug &lt;API&gt;"
    assert docs.resp_body =~ ~s(window.__FLEXDOC_SPEC_URL__="/openapi.json")

    js = conn(:get, "/reference/__flexdoc/renderer.js") |> FlexDocPlug.call(@opts)
    assert js.status == 200
    assert get_resp_header(js, "cache-control") == ["public, max-age=31536000, immutable"]
    assert byte_size(js.resp_body) > 1000
  end

  test "returns 404 outside the configured mount" do
    conn = conn(:get, "/elsewhere") |> FlexDocPlug.call(@opts)
    assert conn.status == 404
  end
end
