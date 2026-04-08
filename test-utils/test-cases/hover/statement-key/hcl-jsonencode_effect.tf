---
includes:
  - required element
  - Allow
  - Deny
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [
      {
        Eff$0ect = "Allow"
      }
    ]
  })
}
