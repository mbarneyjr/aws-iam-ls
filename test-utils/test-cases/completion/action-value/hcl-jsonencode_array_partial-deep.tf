---
includes:
  - s3:GetObject
excludes:
  - lambda:InvokeFunction
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:G$0"
      ]
    }]
  })
}
