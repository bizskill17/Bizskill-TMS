<?php
declare(strict_types=1);
require_once __DIR__.'/../api/checklist_notes.php';
function note_check(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
$legacy=cl_legacy_note(['introduction'=>"PAN\nAadhaar <required>",'items'=>'["Photo","Mobile"]','closing_note'=>'Thank you.']);
note_check(str_contains($legacy,'&lt;required&gt;')&&str_contains($legacy,'<ol><li>Photo</li><li>Mobile</li></ol>'),'Legacy intro and items must be escaped and combined');
note_check(!str_contains($legacy,'Thank you.'),'Closing note must be excluded');
$clean=cl_sanitize_note('<p onclick="alert(1)"><b>PAN</b> <i>Aadhaar</i></p><ul><li>Photo</li></ul><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">Bad</a><a href="https://example.com" style="color:red">Good</a><svg><script>bad()</script></svg>');
foreach(['onclick','onerror','javascript:','<script','<img','<svg','style='] as $bad)note_check(!str_contains($clean,$bad),'Unsafe markup remained: '.$bad);
foreach(['<b>PAN</b>','<i>Aadhaar</i>','<ul><li>Photo</li></ul>','href="https://example.com"','noopener noreferrer'] as $good)note_check(str_contains($clean,$good),'Formatting lost: '.$good);
note_check(!str_contains(cl_sanitize_note('<a href="jav&#x61;script:alert(1)">Bad</a>'),'href='),'Encoded script URLs rejected');
note_check(cl_note_text(cl_sanitize_note('<p>&nbsp;<br></p>'))==='','Visually empty notes rejected');
note_check(cl_note_text(cl_sanitize_note('<p>नमस्ते</p>'))==='नमस्ते','Unicode retained');
echo "Checklist note migration, formatting and sanitization rules passed.\n";
