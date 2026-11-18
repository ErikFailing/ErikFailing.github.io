{{- /* Archetype for `hugo new content posts/...`. Fill in `project` with the folder name under
       content/projects/ the post belongs to. The post's number ("#2.3": project 2, part 3) is
       worked out from that project and the post's date, so there's no number to set here. */ -}}
+++
date = '{{ .Date }}'
draft = true
title = '{{ replace .File.ContentBaseName "-" " " | title }}'
project = ''
tags = []
+++
