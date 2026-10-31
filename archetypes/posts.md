{{- /* Archetype for `hugo new content posts/...`. `number` is the next post number: one more than
       the highest number on the existing posts. Two drafts started at the same time can get the
       same number; the build fails on duplicates, so renumber one before publishing. */ -}}
{{- $max := 0 -}}
{{- range where site.RegularPages "Section" "posts" -}}
  {{- with .Params.number }}{{ if gt (int .) $max }}{{ $max = int . }}{{ end }}{{ end -}}
{{- end -}}
+++
date = '{{ .Date }}'
draft = true
title = '{{ replace .File.ContentBaseName "-" " " | title }}'
number = {{ add $max 1 }}
tags = []
+++
