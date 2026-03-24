---
includes:
  - arn
---
data "aws_iam_policy_document" "s3_write_only_policy_document" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObjectAcl"
    ]
    resources = [
      "arn:aws:"
    ]
  }
}

resource "aws_iam_policy" "s3_read_only_policy" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = [
      ]
      Resource = [
        "$0
      ]
    }]
  })
}
