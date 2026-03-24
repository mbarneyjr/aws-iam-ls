---
includes: []
excludes:
  - s3:GetObject
  - lambda:InvokeFunction
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = [
        $0
      ]
    }]
  })
}
