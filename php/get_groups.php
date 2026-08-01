<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

$instructor = $_GET['instructor'] ?? '';
$section = $_GET['section'] ?? '';

if (empty($instructor)) {
    echo json_encode(["status" => "error", "message" => "instructor parameter required"]);
    exit;
}

$group_names = ['GROUP 1','GROUP 2','GROUP 3','GROUP 4','GROUP 5','GROUP 6','GROUP 7','GROUP 8','GROUP 9','GROUP 10'];

try {

if (!empty($section)) {
    $count_stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM groups_table WHERE instructor=? AND section=?");
    $count_stmt->bind_param("ss", $instructor, $section);
} else {
    $count_stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM groups_table WHERE instructor=?");
    $count_stmt->bind_param("s", $instructor);
}
$count_stmt->execute();
$count_row = $count_stmt->get_result()->fetch_assoc();
$count_stmt->close();

if (intval($count_row['cnt']) === 0) {
    foreach ($group_names as $gn) {
        $chk = $conn->prepare("SELECT id FROM groups_table WHERE group_name=? AND instructor=? AND section=?");
        $chk->bind_param("sss", $gn, $instructor, $section);
        $chk->execute();
        $exists = $chk->get_result()->fetch_assoc();
        $chk->close();
        if (!$exists) {
            $ins = $conn->prepare("INSERT INTO groups_table (group_name, instructor, section) VALUES (?, ?, ?)");
            $ins->bind_param("sss", $gn, $instructor, $section);
            $ins->execute();
            $ins->close();
        }
    }
}

if (!empty($section)) {
    $grp_sql = "SELECT group_name, member1_name, member2_name, member3_name, member4_name, member5_name, is_closed FROM groups_table WHERE instructor=? AND section=?";
    $stmt = $conn->prepare($grp_sql);
    $stmt->bind_param("ss", $instructor, $section);
} else {
    $grp_sql = "SELECT group_name, member1_name, member2_name, member3_name, member4_name, member5_name, is_closed FROM groups_table WHERE instructor=?";
    $stmt = $conn->prepare($grp_sql);
    $stmt->bind_param("s", $instructor);
}
$stmt->execute();
$result = $stmt->get_result();

$groups = [];
while ($row = $result->fetch_assoc()) {
    $groups[$row['group_name']] = [
        'member1_name' => $row['member1_name'],
        'member2_name' => $row['member2_name'],
        'member3_name' => $row['member3_name'],
        'member4_name' => $row['member4_name'],
        'member5_name' => $row['member5_name'],
        'is_closed' => intval($row['is_closed'])
    ];
}
$stmt->close();

$gr_sql = "SELECT group_name, SUM(total_score) as total_score, COUNT(*) as num_ratings FROM group_ratings WHERE instructor=?";
$params = [$instructor];
$types = "s";
if (!empty($section)) {
    $gr_sql .= " AND section=?";
    $params[] = $section;
    $types .= "s";
}
$gr_sql .= " GROUP BY group_name";

$stmt2 = $conn->prepare($gr_sql);
if (count($params) === 1) {
    $stmt2->bind_param("s", $instructor);
} else {
    $stmt2->bind_param("ss", $params[0], $params[1]);
}
$stmt2->execute();
$result2 = $stmt2->get_result();

$group_ratings = [];
while ($row = $result2->fetch_assoc()) {
    $group_ratings[$row['group_name']] = [
        'total_score' => intval($row['total_score']),
        'num_ratings' => intval($row['num_ratings'])
    ];
}
$stmt2->close();

$response = [];
foreach ($group_names as $gn) {
    $grp = $groups[$gn] ?? ['member1_name'=>'', 'member2_name'=>'', 'member3_name'=>'', 'member4_name'=>'', 'member5_name'=>'', 'is_closed'=>0];
    $rat = $group_ratings[$gn] ?? ['total_score'=>0, 'num_ratings'=>0];

    $response[$gn] = [
        'group_name' => $gn,
        'member1_name' => $grp['member1_name'],
        'member2_name' => $grp['member2_name'],
        'member3_name' => $grp['member3_name'],
        'member4_name' => $grp['member4_name'],
        'member5_name' => $grp['member5_name'],
        'is_closed' => $grp['is_closed'],
        'total_score' => $rat['total_score'],
        'num_ratings' => $rat['num_ratings']
    ];
}

echo json_encode(["status" => "success", "groups" => $response]);

} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}

$conn->close();
?>
