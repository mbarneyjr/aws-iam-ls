---
includes:
  - "service:action"
  - case-insensitive
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [
      {
        Effect = "Allow"
        Act$0ion = ["s3:GetObject"]
      }
    ]
  })
}
