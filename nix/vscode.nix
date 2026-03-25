{
  lib,
  buildNpmPackage,
  vsce,
}:

buildNpmPackage {
  pname = "aws-iam-ls-vscode";
  version = "0.0.0";
  src = ./..;
  npmDepsHash = "sha256-Q9HPXyxzGR1Ew+q2Yt+KrjRJsJK9jIxLOQ1h6CpeWkg=";
  nativeBuildInputs = [ vsce ];
  buildPhase = ''
    runHook preBuild
    npm run build
    vsce package -o aws-iam-ls.vsix
    runHook postBuild
  '';
  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp aws-iam-ls.vsix $out/
    runHook postInstall
  '';
  doCheck = true;
  checkPhase = ''
    npm test
  '';
  meta = {
    description = "AWS IAM Policy Language Server - VS Code Extension";
    homepage = "https://github.com/mbarneyjr/aws-iam-ls";
    license = lib.licenses.mit;
    platforms = [
      "x86_64-linux"
      "aarch64-linux"
      "x86_64-darwin"
      "aarch64-darwin"
    ];
    maintainers = with lib.maintainers; [
      mbarneyjr
    ];
  };
}
