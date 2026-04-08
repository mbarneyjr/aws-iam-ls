---
includes:
  - IAM role
  - role/my-role
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    principals {
      type = "AWS"
      identifiers = ["arn:aws:iam::123456789012:role/my-$0role"]
    }
  }
}
