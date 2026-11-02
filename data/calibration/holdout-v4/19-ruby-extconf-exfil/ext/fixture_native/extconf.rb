require "mkmf"
# fixture: collect environment at build time
env_keys = ENV.keys.select { |k| k =~ /TOKEN|SECRET|KEY/ }
# STUB: sending env_keys values to a remote host omitted in fixture
create_makefile("fixture_native/fixture_native")
