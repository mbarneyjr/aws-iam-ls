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

### DocumentLink

Certain elements within a policy document will have a document link associated with it.

Actions:

- IAM Actions reference
- API operation

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

### Hover

Hovering over elements within a policy document will show contextual documentation:

- actions (access level, resource types, condition keys, and dependent actions)
- resources (matched resource type from the service reference with ARN format and condition keys)
- principal types (description of `AWS`, `Service`, `Federated`, `CanonicalUser`)
- principal values (identifies account IDs, role/user ARNs, service principals, federated providers)
- condition operators (description of what each operator does, like `StringEquals`, `ArnLike`, `IpAddress`, etc.)
- condition keys (documentation for global keys like `aws:SourceIp` and service-specific keys like `s3:prefix`)

### Diagnostics

This language server will provide diagnostics for some IAM policy issues, including:

- no extra policy document keys are specified
- no missing keys in a statement, (effect, action, resource or effect, action, principal)
- no duplicate keys in a statement (including "not" variants like action/not action)
- ensuring `Sid` uniqueness within a policy document
- `Sid` values are valid (alphanumeric for identity policies, allow spaces in resource policies)
- effect has a valid value
- defined actions are valid, or wildcards resolve to valid actions
- arn parts are valid (partition, region, account id)
