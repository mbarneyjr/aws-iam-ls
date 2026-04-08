---
includes:
  - object or objects
  - ARN
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Reso$0urce = ["*"]
      }
    ]
  })
}
