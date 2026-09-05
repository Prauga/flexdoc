defmodule PraugaFlexDoc.MixProject do
  use Mix.Project

  @version "0.2.0"

  def project do
    [
      app: :prauga_flexdoc,
      version: @version,
      elixir: "~> 1.17",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      description: "Self-hosted FlexDoc OpenAPI renderer Plug for Phoenix and Plug applications",
      package: package(),
      source_url: "https://github.com/prauga/flexdoc",
      homepage_url: "https://github.com/prauga/flexdoc"
    ]
  end

  def application, do: [extra_applications: [:logger, :crypto]]

  defp deps do
    [
      {:plug, "~> 1.19"},
      {:jason, "~> 1.4"},
      {:ex_doc, "~> 0.40", only: :dev, runtime: false}
    ]
  end

  defp package do
    [
      licenses: ["AGPL-3.0-or-later"],
      links: %{"GitHub" => "https://github.com/prauga/flexdoc"},
      files: ["lib", "assets", "mix.exs", "README.md", "LICENSE"]
    ]
  end
end
