---
includes:
  - s3
  - lambda
---
resource "aws_iam_policy" "s3_read_only_policy" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject"
      ]
      Resource = "*"
    }]
  })
}

data "aws_iam_policy_document" "s3_write_only_policy_document" {
  statement {
    effect = "Allow"
    actions = [
      "$0
    ]
  }
}

resource "aws_iam_policy" "s3_read_only_policy" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject"
      ]
      Resource = "*"
    }]
  })
}
