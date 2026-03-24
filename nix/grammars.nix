{
  tree-sitter-grammars,
  stdenv,
  tree-sitter,
  emscripten,
  symlinkJoin,
}:

let
  grammars = [
    {
      name = "yaml";
      src = tree-sitter-grammars.tree-sitter-yaml.src;
    }
    {
      name = "json";
      src = tree-sitter-grammars.tree-sitter-json.src;
    }
    {
      name = "hcl";
      src = tree-sitter-grammars.tree-sitter-hcl.src;
    }
  ];

  buildGrammarWasm =
    { name, src }:
    stdenv.mkDerivation {
      pname = "tree-sitter-${name}-wasm";
      version = "0.0.1";
      inherit src;

      nativeBuildInputs = [
        tree-sitter
        emscripten
      ];

      buildPhase = ''
        export HOME=$TMPDIR
        export EM_CACHE=$TMPDIR/.emscripten_cache

        tree-sitter build --wasm -o tree-sitter-${name}.wasm .
      '';

      installPhase = ''
        mkdir -p $out
        cp tree-sitter-${name}.wasm $out/
      '';
    };
in
symlinkJoin {
  name = "tree-sitter-grammars-wasm";
  paths = map buildGrammarWasm grammars;
}
