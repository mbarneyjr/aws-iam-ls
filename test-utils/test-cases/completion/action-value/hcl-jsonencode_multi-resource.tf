---
includes:
  - s3:GetObject
  - lambda:InvokeFunction
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
