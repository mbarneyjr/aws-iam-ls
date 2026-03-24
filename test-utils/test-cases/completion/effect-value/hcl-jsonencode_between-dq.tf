---
exact: true
includes:
  - Allow
  - Deny
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "$0"
    }]
  })
}
