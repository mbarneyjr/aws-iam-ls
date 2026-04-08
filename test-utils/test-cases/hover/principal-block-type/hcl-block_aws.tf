---
includes:
  - IAM user
  - IAM role
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    principals {
      type = "AW$0S"
      identifiers = ["arn:aws:iam::123456789012:root"]
    }
  }
}
