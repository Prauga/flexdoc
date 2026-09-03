# frozen_string_literal: true

module Prauga
  module FlexDoc
    module Rails
      module_function

      def mount(mapper, host: Host.new, at: nil, as: :flexdoc)
        mapper.mount RackApp.new(host), at: (at || host.config.path), as: as
        host
      end
    end
  end
end
