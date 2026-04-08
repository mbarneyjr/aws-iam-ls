---
includes:
  - type of principal
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    principals {
      ty$0pe = "AWS"
      identifiers = ["arn:aws:iam::123456789012:root"]
    }
  }
}
