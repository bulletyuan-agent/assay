Gem::Specification.new do |s|
  s.name = "fixture_native"
  s.version = "0.3.0"
  s.summary = "Native helpers"
  s.files = Dir["lib/**/*.rb", "ext/**/*.rb"]
  s.extensions = ["ext/fixture_native/extconf.rb"]
end
