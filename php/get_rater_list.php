<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

$instructor = $_GET['instructor'] ?? '';
$section = $_GET['section'] ?? '';

if (empty($instructor)) {
    echo json_encode(["status" => "error", "message" => "instructor parameter required"]);
    exit;
}

$students = [];
if (!empty($section)) {
    $stmt = $conn->prepare("SELECT group_name, member1_name, member2_name, member3_name, member4_name, member5_name FROM groups_table WHERE instructor=? AND section=?");
    $stmt->bind_param("ss", $instructor, $section);
} else {
    $stmt = $conn->prepare("SELECT group_name, member1_name, member2_name, member3_name, member4_name, member5_name FROM groups_table WHERE instructor=?");
    $stmt->bind_param("s", $instructor);
}
$stmt->execute();
$groups_result = $stmt->get_result();
while ($row = $groups_result->fetch_assoc()) {
    foreach (['member1_name', 'member2_name', 'member3_name', 'member4_name', 'member5_name'] as $col) {
        $name = strtoupper(trim($row[$col]));
        if (!empty($name)) {
            $students[$name] = true;
        }
    }
}
$stmt->close();

$student_list = array_keys($students);
sort($student_list);

$voted = [];
if (!empty($section)) {
    $voted_stmt = $conn->prepare("SELECT rater_name, group_name FROM group_ratings WHERE instructor=? AND section=?");
    $voted_stmt->bind_param("ss", $instructor, $section);
} else {
    $voted_stmt = $conn->prepare("SELECT rater_name, group_name FROM group_ratings WHERE instructor=?");
    $voted_stmt->bind_param("s", $instructor);
}
$voted_stmt->execute();
$voted_res = $voted_stmt->get_result();
while ($vr = $voted_res->fetch_assoc()) {
    $rn = strtoupper(trim($vr['rater_name']));
    $voted[$rn][$vr['group_name']] = true;
}
$voted_stmt->close();

$result = [];
foreach ($student_list as $sname) {
    $entry = ['name' => $sname];
    for ($i = 1; $i <= 10; $i++) {
        $gname = 'GROUP ' . $i;
        $entry['GROUP ' . $i] = isset($voted[$sname][$gname]) ? 1 : 0;
    }
    $result[] = $entry;
}

echo json_encode(["status" => "success", "raters" => $result]);
$conn->close();
?>
