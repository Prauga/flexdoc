# frozen_string_literal: true

# Self-hosted FlexDoc integration for Rack and Rails applications.
#
# Require this file to load {Prauga::FlexDoc::Host}, {Prauga::FlexDoc::HostExecution},
# {Prauga::FlexDoc::RackApp}, {Prauga::FlexDoc::Config}, and the Rails mount helper.

require_relative "flexdoc/version"
require_relative "flexdoc/config"
require_relative "flexdoc/response"
require_relative "flexdoc/host_execution"
require_relative "flexdoc/host"
require_relative "flexdoc/rack_app"
require_relative "flexdoc/rails"
