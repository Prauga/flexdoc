# frozen_string_literal: true

require_relative "lib/prauga/flexdoc/version"

Gem::Specification.new do |spec|
  spec.name = "prauga-flexdoc"
  spec.version = Prauga::FlexDoc::VERSION
  spec.authors = ["Prauga"]
  spec.summary = "Self-hosted FlexDoc integration for Rack and Rails"
  spec.description = "Framework-neutral Ruby host for the canonical FlexDoc OpenAPI renderer with thin Rack and Rails integrations."
  spec.homepage = "https://github.com/prauga/flexdoc"
  spec.license = "AGPL-3.0-or-later"
  spec.required_ruby_version = ">= 3.2"
  spec.metadata = {
    "source_code_uri" => "https://github.com/prauga/flexdoc",
    "bug_tracker_uri" => "https://github.com/prauga/flexdoc/issues"
  }
  spec.files = Dir["lib/**/*", "assets/*", "README.md", "LICENSE"]
  spec.require_paths = ["lib"]

  spec.add_development_dependency "actionpack", ">= 7.2", "< 9"
  spec.add_development_dependency "minitest", "~> 5.25"
  spec.add_development_dependency "rack", ">= 3.1", "< 4"
  spec.add_development_dependency "rake", ">= 13.2", "< 14"
end
