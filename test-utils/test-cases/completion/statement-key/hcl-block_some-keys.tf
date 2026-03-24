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
data "aws_iam_policy_document" "s3_write_only_policy_document" {
  statement {
    effect = "Allow"
    $0
  }
}
