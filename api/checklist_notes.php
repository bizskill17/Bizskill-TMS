<?php
declare(strict_types=1);

function cl_safe_link(string $href): bool {
    return !preg_match('/[\x00-\x20\x7f]/', $href)
        && (bool)preg_match('~^(https?://|mailto:)~i', $href);
}
function cl_sanitize_note(string $html): string {
    if (strlen($html)>200000) throw new InvalidArgumentException('Note is too long.');
    $doc=new DOMDocument('1.0','UTF-8');
    $before=libxml_use_internal_errors(true);
    try { $doc->loadHTML('<?xml encoding="UTF-8"><html><body>'.$html.'</body></html>',LIBXML_NONET); }
    finally {libxml_clear_errors();libxml_use_internal_errors($before);}
    $body=$doc->getElementsByTagName('body')->item(0);
    if (!$body) return '';
    $allowed=['p','div','br','b','strong','i','em','u','ul','ol','li','a','blockquote'];
    $blocked=['script','style','iframe','object','embed','svg','math','template','form','input','button','textarea','select','meta','link','base'];
    $clean=function(DOMNode $parent) use (&$clean,$allowed,$blocked):void {
        foreach (iterator_to_array($parent->childNodes) as $node) {
            if ($node instanceof DOMElement) {
                $tag=strtolower($node->tagName);
                if (in_array($tag,$blocked,true)) {$parent->removeChild($node);continue;}
                $clean($node);
                if (!in_array($tag,$allowed,true)) {
                    while($node->firstChild)$parent->insertBefore($node->firstChild,$node);
                    $parent->removeChild($node);continue;
                }
                $href=$tag==='a'?trim($node->getAttribute('href')):'';
                foreach(iterator_to_array($node->attributes) as $attr)$node->removeAttribute($attr->name);
                if($tag==='a'&&cl_safe_link($href)){
                    $node->setAttribute('href',$href);
                    $node->setAttribute('target','_blank');
                    $node->setAttribute('rel','noopener noreferrer');
                }
            } elseif (!($node instanceof DOMText)) {$parent->removeChild($node);}
        }
    };
    $clean($body);$result='';
    foreach($body->childNodes as $node)$result.=$doc->saveHTML($node);
    return $result;
}
function cl_note_text(string $html): string {
    return trim(str_replace("\xc2\xa0",' ',html_entity_decode(strip_tags(preg_replace('~<br\s*/?>|</(?:p|div|li|ul|ol|blockquote)>~i',"\n",$html)),ENT_QUOTES|ENT_HTML5,'UTF-8')));
}
function cl_legacy_note(array $row): string {
    $escape=fn($s)=>htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $intro=trim((string)($row['introduction']??''));
    $html=$intro!==''?'<p>'.nl2br($escape($intro),false).'</p>':'';
    $items=$row['items']??[];if(is_string($items))$items=json_decode($items,true);
    $items=is_array($items)?array_values(array_filter($items,fn($s)=>is_string($s)&&trim($s)!=='')):[];
    if($items){$html.='<ol>';foreach($items as $item)$html.='<li>'.nl2br($escape(trim($item)),false).'</li>';$html.='</ol>';}
    // Closing notes are deliberately not part of the simplified Note.
    return $html;
}
function cl_schema(mysqli $db):void {
    dsc_query($db,"CREATE TABLE IF NOT EXISTS checklist_templates (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,tenant_id INT NOT NULL,name VARCHAR(190) NOT NULL,category VARCHAR(190) NOT NULL DEFAULT '',introduction TEXT NOT NULL,items MEDIUMTEXT NOT NULL,closing_note TEXT NOT NULL,note_html MEDIUMTEXT NULL,active TINYINT NOT NULL DEFAULT 1,version INT NOT NULL DEFAULT 1,KEY checklist_tenant (tenant_id,active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $found=dsc_all($db,"SHOW COLUMNS FROM checklist_templates LIKE 'note_html'");
    if(!$found){
        try {dsc_query($db,'ALTER TABLE checklist_templates ADD COLUMN note_html MEDIUMTEXT NULL');}
        catch(mysqli_sql_exception $e){if($e->getCode()!==1060)throw $e;}
    }
    foreach(['sort_order','color_index'] as $column){
        if(!dsc_all($db,"SHOW COLUMNS FROM checklist_templates LIKE '".$column."'")){
            try {dsc_query($db,'ALTER TABLE checklist_templates ADD COLUMN '.$column.' INT NULL');}
            catch(mysqli_sql_exception $e){if($e->getCode()!==1060)throw $e;}
        }
    }
    $rows=dsc_all($db,'SELECT id,tenant_id FROM checklist_templates WHERE sort_order IS NULL OR color_index IS NULL ORDER BY tenant_id,name,id');
    $positions=[];
    foreach($rows as $row){
        $tenant=(int)$row['tenant_id'];
        if(!isset($positions[$tenant])){
            $max=dsc_all($db,'SELECT COALESCE(MAX(sort_order),-1) AS last_position FROM checklist_templates WHERE tenant_id=?',[$tenant]);
            $positions[$tenant]=(int)$max[0]['last_position']+1;
        }
        $position=$positions[$tenant]++;
        dsc_query($db,'UPDATE checklist_templates SET sort_order=COALESCE(sort_order,?),color_index=COALESCE(color_index,?) WHERE id=?',[$position,$position%8,(int)$row['id']]);
    }

}
