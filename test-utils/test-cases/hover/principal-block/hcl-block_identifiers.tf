---
includes:
  - principal identifiers
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    principals {
      type = "AWS"
      ident$0ifiers = ["arn:aws:iam::123456789012:root"]
    }
  }
}
