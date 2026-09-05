defmodule PraugaFlexDoc.Config do
  @moduledoc false
  defstruct path: "/docs",
            spec_url: "/openapi.json",
            title: "API Reference",
            theme: "system",
            try_it_enabled: true,
            expand: nil,
            try_it_default_server: nil,
            try_it_credentials: nil,
            try_it_api_client_persistence_key: nil

  def new(opts \\ []) do
    config = struct!(__MODULE__, Map.new(opts))
    path = "/" <> (config.path |> to_string() |> String.trim() |> String.trim("/"))
    path = if path == "/", do: "/docs", else: path
    theme = to_string(config.theme)
    unless theme in ["system", "light", "dark"], do: raise(ArgumentError, "FlexDoc theme must be system, light, or dark")

    if config.try_it_credentials not in [nil, "omit", "same-origin", "include"] do
      raise ArgumentError, "FlexDoc Try It credentials must be omit, same-origin, or include"
    end

    persistence_key = config.try_it_api_client_persistence_key
    unless is_nil(persistence_key) or persistence_key == false or is_binary(persistence_key) do
      raise ArgumentError, "FlexDoc API Client persistence key must be a string, false, or nil"
    end

    %{config | path: path, theme: theme}
  end
end
