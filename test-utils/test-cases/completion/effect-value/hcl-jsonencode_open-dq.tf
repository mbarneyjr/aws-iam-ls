---
exact: true
includes:
  - Allow
  - Deny
---
resource "aws_iam_policy" "s3_read_only_policy" {
  policy = jsonencode({
    Statement = [{
      Effect = "$0
      Action = [
        "s3:GetObject"
      ]
    }]
  })
}
