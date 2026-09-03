defmodule PraugaFlexDoc.Config do
  @moduledoc false
  defstruct path: "/docs",
            spec_url: "/openapi.json",
            title: "API Reference",
            theme: "system",
            try_it_enabled: true

  def new(opts \\ []) do
    config = struct!(__MODULE__, Map.new(opts))
    path = "/" <> (config.path |> to_string() |> String.trim() |> String.trim("/"))
    path = if path == "/", do: "/docs", else: path
    theme = to_string(config.theme)
    unless theme in ["system", "light", "dark"], do: raise(ArgumentError, "FlexDoc theme must be system, light, or dark")
    %{config | path: path, theme: theme}
  end
end
