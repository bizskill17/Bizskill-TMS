<?php
declare(strict_types=1);
require_once __DIR__.'/../api/task_reassignment.php';
function expect_same($actual, $expected, string $label): void {
    if ($actual !== $expected) throw new RuntimeException($label.': '.json_encode($actual));
}
expect_same(task_assignment_changed('Aman, Avishi',' Avishi , Aman '),false,'Ignore order and whitespace');
expect_same(task_assignment_changed('Aman, Aman','aman'),false,'Ignore duplicates and case');
expect_same(task_assignment_changed('Aman','Avishi'),true,'Replacement triggers message');
expect_same(task_assignment_changed('Aman','Aman, Avishi'),true,'Adding assignee triggers message');
expect_same(task_assignment_changed('Aman, Avishi','Aman'),true,'Removing assignee triggers message');
expect_same(task_reassignment_recipients('Aman, Avishi','Aman'),['Aman','Avishi'],'Owner gets one message');
expect_same(task_reassignment_recipients('Avishi','Pankaj'),['Avishi','Pankaj'],'New assignees plus owner only');
expect_same(task_reassignment_recipients('','Pankaj'),['Pankaj'],'Unassignment notifies owner');
$message=task_reassignment_message(['title'=>'GST Filing','firm'=>'ABC','assignees'=>'Avishi','dueDate'=>'2026-11-20'],['remarks'=>'Please complete'],'Aman','30/10/2026 12:30');
foreach (['*Task Reassigned*','*Task:* GST Filing','*Client:* ABC','*Previous Assignees:* Aman','*New Assignees:* Avishi','*Due Date:* 20/11/2026','*Remarks:* Please complete','*Reassigned At:* 30/10/2026 12:30'] as $line) {
    if (strpos($message,$line)===false) throw new RuntimeException('Missing message line: '.$line);
}
echo "Task reassignment tests passed\n";
