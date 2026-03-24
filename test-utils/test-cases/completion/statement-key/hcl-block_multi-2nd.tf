---
exact: true
includes:
  - sid
  - principals
  - not_principals
  - actions
  - not_actions
  - resources
  - not_resources
  - condition
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Deny"
    actions   = ["*"]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    $0
  }
}
