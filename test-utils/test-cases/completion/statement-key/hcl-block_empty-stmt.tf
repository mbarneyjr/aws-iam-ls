---
exact: true
includes:
  - sid
  - effect
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
    $0
  }
}
