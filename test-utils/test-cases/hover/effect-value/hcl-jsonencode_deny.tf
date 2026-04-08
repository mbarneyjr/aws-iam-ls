---
includes:
  - Explicitly denies
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [
      {
        Effect = "De$0ny"
      }
    ]
  })
}
