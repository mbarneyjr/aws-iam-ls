---
exact: true
includes: []
---
data "aws_iam_policy_document" "s3_write_only_policy_document" {
  statement {
    effect = $0
  }
}
