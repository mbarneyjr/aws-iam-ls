---
exact: true
includes:
  - Allow
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "A$0"
  }
}
