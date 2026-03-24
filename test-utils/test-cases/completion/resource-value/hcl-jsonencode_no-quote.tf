---
includes: []
excludes:
  - arn
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = [
        $0
      ]
    }]
  })
}
