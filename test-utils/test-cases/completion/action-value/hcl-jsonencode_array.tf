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
        "$0
      ]
    }]
  })
}
