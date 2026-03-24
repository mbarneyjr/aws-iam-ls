---
exact: true
includes:
  - Allow
  - Deny
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "$0"
  }
}
