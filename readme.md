# AWS IAM Policy Language Server

This is a language server that provides a better DX for writing IAM policies.

It supports policies written in

- YAML
- JSON
- CloudFormation/SAM (YAML or JSON)
- HCL (`jsonencode` objects or `statement` blocks)

## Installation

### Visual Studio Code

Install the [extension](https://marketplace.visualstudio.com/items?itemName=MichaelBarney.aws-iam-language-server).

### Neovim, etc

You can install the language server globally with npm:

```sh
npm install -g aws-iam-language-server
```

And then you can set your editor up, for instance if you're running Neovim:

```lua
vim.lsp.config("aws-iam-language-server", {
  cmd = { "aws-iam-language-server", "--stdio" },
  filetypes = { "yaml", "yaml.cloudformation", "json", "json.cloudformation", "terraform", "tofu" },
  root_markers = { ".git" },
})

vim.lsp.enable("aws-iam-language-server")
```

## Features

### Completion

This language server provides completion on:

- statement keys (`Effect`, `Action`, `Resource`, etc)
- effect values (`Allow`/`Deny`)
- principal types (`AWS`, `Federated`, `*`, etc)
- principal type values (service principals, aws arns, etc)
- IAM actions
- resources (progressive arn component suggestions, full arn completions for action-specific arns)
- condition operators (`StringLike`, `ForAnyValue:*`, etc)
- condition keys (global keys like `aws:RequestTag/${TagKey}`, action-specific keys like `s3:TlsVersion`)
