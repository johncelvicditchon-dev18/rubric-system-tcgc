<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

$instructor = $_GET['instructor'] ?? '';
$section = $_GET['section'] ?? '';

if (empty($instructor)) {
    echo json_encode(["status" => "error", "message" => "instructor parameter required"]);
    exit;
}

$members = [];
if (!empty($section)) {
    $stmt = $conn->prepare("SELECT group_name, member1_name, member2_name, member3_name, member4_name, member5_name FROM groups_table WHERE instructor=? AND section=?");
    $stmt->bind_param("ss", $instructor, $section);
} else {
    $stmt = $conn->prepare("SELECT group_name, member1_name, member2_name, member3_name, member4_name, member5_name FROM groups_table WHERE instructor=?");
    $stmt->bind_param("s", $instructor);
}
$stmt->execute();
$groups_result = $stmt->get_result();
$group_members = [];
while ($row = $groups_result->fetch_assoc()) {
    $group_members[$row['group_name']] = $row;
}
$stmt->close();

$all_raters = [];
foreach ($group_members as $gn => $gm) {
    foreach (['member1_name', 'member2_name', 'member3_name', 'member4_name', 'member5_name'] as $col) {
        $name = strtoupper(trim($gm[$col]));
        if (!empty($name) && !isset($all_raters[$name])) {
            $all_raters[$name] = true;
        }
    }
}

$raters_with_ratings = [];
$group_names = ['GROUP 1','GROUP 2','GROUP 3','GROUP 4','GROUP 5','GROUP 6','GROUP 7','GROUP 8','GROUP 9','GROUP 10'];

$sql = "SELECT rater_name, group_name, total_score FROM group_ratings WHERE instructor=?";
$params = [$instructor];
$types = "s";
if (!empty($section)) {
    $sql .= " AND section=?";
    $params[] = $section;
    $types .= "s";
}

$stmt = $conn->prepare($sql);
if (count($params) === 1) {
    $stmt->bind_param("s", $instructor);
} else {
    $stmt->bind_param("ss", $params[0], $params[1]);
}
$stmt->execute();
$result = $stmt->get_result();
while ($row = $result->fetch_assoc()) {
    $rn = strtoupper(trim($row['rater_name']));
    if (!isset($raters_with_ratings[$rn])) {
        $raters_with_ratings[$rn] = [];
    }
    $raters_with_ratings[$rn][$row['group_name']] = intval($row['total_score']);
}
$stmt->close();

$all_rater_names = array_unique(array_merge(array_keys($all_raters), array_keys($raters_with_ratings)));
sort($all_rater_names);

$response = [];
foreach ($all_rater_names as $name) {
    $entry = ['name' => $name];
    foreach ($group_names as $gn) {
        $entry[$gn] = isset($raters_with_ratings[$name][$gn]) ? $raters_with_ratings[$name][$gn] : null;
    }
    $response[] = $entry;
}

echo json_encode(["status" => "success", "ratings" => $response]);
$conn->close();
?>
